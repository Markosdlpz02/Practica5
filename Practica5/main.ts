import { MongoClient } from "mongodb";
import { schema } from "./schema.ts";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { resolvers } from "./resolvers.ts";
import { CommentModel, PostModel, UserModel } from "./types.ts";

const MONGO_URL = Deno.env.get("MONGO_URL");

if(!MONGO_URL){
    throw new Error("Please provide a MONGO_URL");
}

const client = new MongoClient(MONGO_URL)
await client.connect();

console.info("Conectado a MongoDB");

const db = client.db("Red_Social");
const UserCollection = db.collection<UserModel>("Usuarios");
const PostCollection = db.collection<PostModel>("Publicaciones");
const CommentCollection = db.collection<CommentModel>("Comentarios");

const server = new ApolloServer({
    typeDefs:schema,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    context: async () => ({UserCollection, PostCollection, CommentCollection,
    }),
  });
  
console.info(`Server ready at ${url}`);


