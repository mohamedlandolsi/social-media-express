const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      max: 100,
    },
    description: {
      type: String,
      max: 500,
    },
    image: {
      type: String,
    },
    likes: {
      type: Array,
      default: [],
    },
    category: {
      type: String,
      required: true,
      default: "Other",
    },
    comments: [
      {
        userId: {
          type: String,
          required: true,
        },
        username: {
          type: String,
          required: true,
        },
        text: {
          type: String,
          required: true,
          max: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
