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
      max: 100, // Set a maximum length for the title
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
      enum: ["Technology", "Health", "Lifestyle", "Education", "Other"], // Example categories
      default: "Other",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);