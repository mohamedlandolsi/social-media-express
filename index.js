const express = require("express");
const cors = require("cors");
const app = express();

// Mongoose is a MongoDB object modeling tool designed to work in an asynchronous environment
const mongoose = require("mongoose");

// Dotenv is a zero-dependency module that loads environment variables from a .env file into process.env
const dotenv = require("dotenv");

// Helmet helps you secure your Express apps by setting various HTTP headers
const helmet = require("helmet");

// Morgan is a middleware that logs HTTP requests
const morgan = require("morgan");

// Use CORS middleware
app.use(cors());

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Importing routes
const userRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const postRouter = require("./routes/posts");

dotenv.config();

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log("Connected to MongoDB");
});

// Middlewares
app.use(express.json());
app.use(helmet());
app.use(morgan("common"));

app.use("/api/users", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/post", postRouter);

app.listen(3000, () => {
  console.log("Backend server is running on port 3000");
});
