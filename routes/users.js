const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
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

// Update user (Protected route)
router.put("/:id", verifyToken, async (req, res) => {
  if (req.user.id === req.params.id || req.user.isAdmin) {
    // If the user wants to update the password
    if (req.body.password) {
      try {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
      } catch (err) {
        return res.status(500).json(err);
      }
    }

    // Update the user
    try {
      await User.findByIdAndUpdate(req.params.id, {
        $set: req.body,
      });
      res.status(200).json("Account has been updated");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can only update your account!");
  }
});

// Delete User (Protected route)
router.delete("/:id", verifyToken, async (req, res) => {
  if (req.user.id === req.params.id || req.user.isAdmin) {
    // Delete the user
    try {
      await User.findByIdAndDelete(req.params.id);
      res.status(200).json("Account has been deleted");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can only delete your own account!");
  }
});

// Get a user (Public route)
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { password, updatedAt, ...other } = user._doc;
    res.status(200).json(other);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all users (Public route)
router.get("/", async (req, res) => {
  const query = req.query.new;
  try {
    const users = query
      ? await User.find().sort({ _id: -1 }).limit(10)
      : await User.find();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Follow a user (Protected route)
router.put("/:id/follow", verifyToken, async (req, res) => {
  // If the user is not the same as the one who is following
  if (req.user.id !== req.params.id) {
    try {
      const user = await User.findById(req.params.id);
      const currentUser = await User.findById(req.user.id);

      // If the user is not already followed
      if (!user.followers.includes(req.user.id)) {
        await user.updateOne({ $push: { followers: req.user.id } });
        await currentUser.updateOne({ $push: { followings: req.params.id } });
        res.status(200).json(`User ${user.username} has been followed`);
      } else {
        res.status(403).json("You already follow this user");
      }
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("You can't follow yourself");
  }
});

// Unfollow a user (Protected route)
router.put("/:id/unfollow", verifyToken, async (req, res) => {
  // If the user is not the same as the one who is unfollowing
  if (req.user.id !== req.params.id) {
    try {
      const user = await User.findById(req.params.id);
      const currentUser = await User.findById(req.user.id);

      // If the user is already followed
      if (user.followers.includes(req.user.id)) {
        await user.updateOne({ $pull: { followers: req.user.id } });
        await currentUser.updateOne({ $pull: { followings: req.params.id } });
        res.status(200).json(`User ${user.username} has been unfollowed`);
      } else {
        res.status(403).json("You don't follow this user");
      }
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("You can't unfollow yourself");
  }
});

module.exports = router;
