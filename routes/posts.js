const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
require('dotenv').config();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify token (protects routes)
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json("Access Denied");

  try {
    const verified = jwt.verify(token.split(" ")[1], JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json("Invalid Token");
  }
};

// Create a post (Protected route)
router.post("/", verifyToken, async (req, res) => {
  const newPost = new Post({ ...req.body, userId: req.user.id }); // Set the userId from the verified token
  try {
    const savedPost = await newPost.save();
    res.status(200).json(savedPost);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Update a post (Protected route)
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    if (post.userId === req.user.id) {
      await post.updateOne({ $set: req.body });
      res.status(200).json("The post has been updated");
    } else {
      res.status(403).json("You can only update your own post");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Delete a post (Protected route)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    if (post.userId === req.user.id) {
      await post.deleteOne();
      res.status(200).json("The post has been deleted");
    } else {
      res.status(403).json("You can only delete your own post");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Like/Dislike a post (Protected route)
router.put("/:id/like", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    if (!post.likes.includes(req.user.id)) {
      await post.updateOne({ $push: { likes: req.user.id } });
      res.status(200).json("The post has been liked");
    } else {
      await post.updateOne({ $pull: { likes: req.user.id } });
      res.status(200).json("The post has been disliked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get a post (Public route)
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get timeline posts (Protected route)
router.get("/timeline/all", verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id); // Using the userId from the verified token
    const userPosts = await Post.find({ userId: currentUser._id });
    const followingsPosts = await Promise.all(
      currentUser.followings.map((followingId) => {
        return Post.find({ userId: followingId });
      })
    );
    res.json(userPosts.concat(...followingsPosts));
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
