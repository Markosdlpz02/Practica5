import { Collection, ObjectId } from "mongodb";
import { CommentModel, PostModel, UserModel } from "./types.ts";
import { GraphQLError } from "graphql";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts"; // Para cifrar contraseñas, he buscado librerias de deno para este uso, he usado esta web para las referencias: https://deno.land/x/bcrypt@v0.4.1

type Context = {
  UserCollection: Collection<UserModel>;
  PostCollection: Collection<PostModel>;
  CommentCollection: Collection<CommentModel>;
};

export const resolvers = {
  Query: {
    users: async (
      _: unknown,
      __: unknown,
      ctx: Context,
    ): Promise<UserModel[]> => {
      return await ctx.UserCollection.find().toArray();
    },

    user: async (
      _: unknown,
      args: { id: string },
      ctx: Context,
    ): Promise<UserModel | null> => {
      const userId = new ObjectId(args.id);
      return await ctx.UserCollection.findOne({ _id: userId });
    },

    posts: async (
      _: unknown,
      __: unknown,
      ctx: Context,
    ): Promise<PostModel[]> => {
      return await ctx.PostCollection.find().toArray();
    },

    post: async (
      _: unknown,
      args: { id: string },
      ctx: Context,
    ): Promise<PostModel | null> => {
      const postId = new ObjectId(args.id);
      return await ctx.PostCollection.findOne({ _id: postId });
    },

    comments: async (
      _: unknown,
      __: unknown,
      ctx: Context,
    ): Promise<CommentModel[]> => {
      return await ctx.CommentCollection.find().toArray();
    },

    comment: async (
      _: unknown,
      args: { id: string },
      ctx: Context,
    ): Promise<CommentModel | null> => {
      const commentId = new ObjectId(args.id);
      return await ctx.CommentCollection.findOne({ _id: commentId });
    },
  },

  Mutation: {
    createUser: async (
      _: unknown,
      args: { input: { name: string; email: string; password: string } },
      ctx: Context,
    ): Promise<UserModel> => {
      const { name, email, password } = args.input;

      const existingUser = await ctx.UserCollection.findOne({ email });
      if (existingUser) {
        throw new GraphQLError("El email ya está registrado");
      }

      const salt = await bcrypt.genSalt(8);
      const hashedPassword = await bcrypt.hash(password, salt);

      const { insertedId } = await ctx.UserCollection.insertOne({
        name,
        email,
        password: hashedPassword,
        posts: [],
        comments: [],
        likedPosts: [],
      });

      return {
        _id: insertedId,
        name,
        email,
        password: hashedPassword,
        posts: [],
        comments: [],
        likedPosts: [],
      };
    },

    updateUser: async (
      _: unknown,
      args: {
        id: string;
        input: { name: string; email: string; password: string };
      },
      ctx: Context,
    ): Promise<UserModel | null> => {
      const userId = new ObjectId(args.id);
      const { name, email, password } = args.input;

      if (email) {
        const existeEmail = await ctx.UserCollection.findOne({ email });

        if (existeEmail && existeEmail._id !== userId) {
          throw new GraphQLError(
            "El email ya está registrado por otro usuario",
          );
        }
      }

      const newUser = await ctx.UserCollection.findOneAndUpdate(
        { _id: userId },
        {
          $set: {
            name: name,
            email: email,
            password: await bcrypt.hash(password, await bcrypt.genSalt(8)),
          },
        },
      );

      return newUser;
    },

    deleteUser: async (
      _: unknown,
      args: { id: string },
      ctx: Context,
    ): Promise<boolean> => {
      const userId = new ObjectId(args.id);

      const { deletedCount } = await ctx.UserCollection.deleteOne({
        _id: userId,
      });
      return deletedCount === 1;
    },

    createPost: async (
      _: unknown,
      args: { input: { content: string; authorId: string } },
      ctx: Context,
    ): Promise<PostModel> => {
      const { content, authorId } = args.input;

      const author = await ctx.UserCollection.findOne({
        _id: new ObjectId(authorId),
      });
      if (!author) {
        throw new GraphQLError("El autor no existe");
      }

      const { insertedId } = await ctx.PostCollection.insertOne({
        content,
        author: new ObjectId(authorId),
        comments: [],
        likes: [],
      });

      return {
        _id: insertedId,
        content,
        author: new ObjectId(authorId),
        comments: [],
        likes: [],
      };
    },

    updatePost: async (
      _: unknown,
      args: { id: string; input: { content?: string } },
      ctx: Context,
    ): Promise<PostModel | null> => {
      const postId = new ObjectId(args.id);
      const { content } = args.input;

      const newPost = await ctx.PostCollection.findOneAndUpdate(
        { _id: postId },
        { $set: { content: content } },
      );

      return newPost;
    },

    deletePost: async (
      _: unknown,
      args: { id: string },
      ctx: Context,
    ): Promise<boolean> => {
      const postId = new ObjectId(args.id);

      const { deletedCount } = await ctx.PostCollection.deleteOne({
        _id: postId,
      });
      return deletedCount === 1;
    },

    addLikeToPost: async (
      _: unknown,
      args: { postId: string; userId: string },
      ctx: Context,
    ): Promise<PostModel | null> => {
      const { postId, userId } = args;

      const post = await ctx.PostCollection.findOne({
        _id: new ObjectId(postId),
      });
      if (!post) {
        throw new GraphQLError("La publicación no existe");
      }

      if (post.likes.includes(new ObjectId(userId))) {
        throw new GraphQLError("El usuario ya ha dado like a esta publicación");
      }

      await ctx.PostCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $push: { likes: new ObjectId(userId) } },
      );

      return await ctx.PostCollection.findOne({ _id: new ObjectId(postId) });
    },

    removeLikeFromPost: async (
      _: unknown,
      args: { postId: string; userId: string },
      ctx: Context,
    ): Promise<PostModel | null> => {
      const { postId, userId } = args;

      const post = await ctx.PostCollection.findOne({
        _id: new ObjectId(postId),
      });
      if (!post) {
        throw new GraphQLError("La publicación no existe");
      }

      if (!post.likes.includes(new ObjectId(userId))) {
        throw new GraphQLError("El usuario no ha dado like a esta publicación");
      }

      await ctx.PostCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $pull: { likes: new ObjectId(userId) } },
      );

      return await ctx.PostCollection.findOne({ _id: new ObjectId(postId) });
    },

    createComment: async (
      _: unknown,
      args: { input: { text: string; authorId: string; postId: string } },
      ctx: Context,
    ): Promise<CommentModel> => {
      const { text, authorId, postId } = args.input;

      const author = await ctx.UserCollection.findOne({
        _id: new ObjectId(authorId),
      });
      if (!author) {
        throw new GraphQLError("El autor no existe");
      }

      const post = await ctx.PostCollection.findOne({
        _id: new ObjectId(postId),
      });
      if (!post) {
        throw new GraphQLError("El post no existe");
      }

      const { insertedId } = await ctx.CommentCollection.insertOne({
        text,
        author: new ObjectId(authorId),
        post: new ObjectId(postId),
      });

      await ctx.PostCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $push: { comments: insertedId } },
      );

      return {
        _id: insertedId,
        text,
        author: new ObjectId(authorId),
        post: new ObjectId(postId),
      };
    },

    updateComment: async (
      _: unknown,
      args: { id: string; input: { text?: string } },
      ctx: Context,
    ): Promise<CommentModel | null> => {
      const commentId = new ObjectId(args.id);
      const { text } = args.input;

      const newComment = await ctx.CommentCollection.findOneAndUpdate(
        { _id: commentId },
        { $set: { text: text } },
      );

      return newComment;
    },

    deleteComment: async (
      _: unknown,
      args: { id: string },
      ctx: Context,
    ): Promise<boolean> => {
      const commentId = new ObjectId(args.id);

      const comment = await ctx.CommentCollection.findOne({ _id: commentId });
      if (!comment) {
        throw new GraphQLError("El comentario no existe");
      }

      const { deletedCount } = await ctx.CommentCollection.deleteOne({
        _id: commentId,
      });

      if (deletedCount === 1) {
        await ctx.PostCollection.updateOne(
          { _id: comment.post },
          { $pull: { comments: commentId } },
        );
        return true;
      }

      return false;
    },
  },

  User: {
    id: (parent: UserModel): string => parent._id!.toString(),
    posts: async (parent: UserModel, _: unknown, ctx: Context) => {
      return await ctx.PostCollection.find({ author: parent._id }).toArray();
    },
    comments: async (parent: UserModel, _: unknown, ctx: Context) => {
      return await ctx.CommentCollection.find({ author: parent._id }).toArray();
    },
    likedPosts: async (parent: UserModel, _: unknown, ctx: Context) => {
      return await ctx.PostCollection.find({ likes: parent._id }).toArray();
    },
  },

  Post: {
    id: (parent: PostModel): string => parent._id!.toString(),
    author: async (parent: PostModel, _: unknown, ctx: Context) => {
      return await ctx.UserCollection.findOne({ _id: parent.author });
    },
    comments: async (parent: PostModel, _: unknown, ctx: Context) => {
      return await ctx.CommentCollection.find({ post: parent._id }).toArray();
    },
    likes: async (parent: PostModel, _: unknown, ctx: Context) => {
      return await ctx.UserCollection.find({ _id: { $in: parent.likes } }).toArray();
    },
  },

  Comment: {
    id: (parent: CommentModel): string => parent._id!.toString(),
    author: async (parent: CommentModel, _: unknown, ctx: Context) => {
      return await ctx.UserCollection.findOne({ _id: parent.author });
    },
    post: async (parent: CommentModel, _: unknown, ctx: Context) => {
      return await ctx.PostCollection.findOne({ _id: parent.post });
    },
  },
};
