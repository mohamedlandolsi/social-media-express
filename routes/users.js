const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
require("dotenv").config();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify token (protects routes)
const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json("Access Denied: No or invalid token provided");
  }

  const token = authHeader.split(" ")[1];
  try {
    const verified = jwt.verify(token, JWT_SECRET); // Decode the token
    console.log("Decoded Token in Middleware:", verified); // Debugging log
    req.user = verified; // Attach to req.user
    next();
  } catch (err) {
    console.error("Token verification error:", err); // Log error details
    res.status(400).json("Invalid Token");
  }
};


//Search user
router.get("/search", verifyToken, async (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json("Invalid or missing query string");
  }

  console.log("User search query received:", query); // Log the incoming query

  try {
    // Define search criteria for users
    const searchCriteria = {
      $or: [
        { username: { $regex: query, $options: "i" } }, // Case-insensitive search for name
      ],
    };

    console.log("Executing user search query:", searchCriteria); // Log the query object

    // Find users matching the criteria
    const users = await User.find(searchCriteria).select("-password -_id"); // Exclude password and _id
    console.log("Found users:", users); // Log found users or an empty array if no users found

    res.status(200).json(users);
  } catch (err) {
    console.error("Error during user search:", err.stack); // Log the full error stack
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
});

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

router.put(
  "/:id",
  verifyToken,
  upload.single("profilePicture"),
  async (req, res) => {
    if (req.user.id === req.params.id || req.user.isAdmin) {
      try {
        const updateData = { ...req.body };
        if (req.file) {
          updateData.profilePicture = req.file.path; // Save file path or other data
        }

        await User.findByIdAndUpdate(req.params.id, { $set: updateData });
        res.status(200).json("Account has been updated");
      } catch (err) {
        return res.status(500).json(err);
      }
    } else {
      return res.status(403).json("You can only update your account!");
    }
  }
);

// Delete User (Protected route)
// router.delete("/:id", verifyToken, async (req, res) => {
//   if (req.user.id === req.params.id || req.user.isAdmin) {
//     // Delete the user
//     try {
//       await User.findByIdAndDelete(req.params.id);
//       res.status(200).json("Account has been deleted");
//     } catch (err) {
//       return res.status(500).json(err);
//     }
//   } else {
//     return res.status(403).json("You can only delete your own account!");
//   }
// });

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

// Update Profile Picture
router.put(
  "/:id/profilePicture",
  verifyToken,
  upload.single("profilePicture"),
  async (req, res) => {
    if (req.user.id === req.params.id || req.user.isAdmin) {
      try {
        const updateData = { ...req.body };
        if (req.file) {
          updateData.profilePicture = req.file.path; // Save file path or other data
        }

        await User.findByIdAndUpdate(req.params.id, { $set: updateData });
        res.status(200).json("Account has been updated");
      } catch (err) {
        return res.status(500).json(err);
      }
    } else {
      return res.status(403).json("You can only update your account!");
    }
  }
);

// Update Cover Picture
router.put(
  "/:id/coverPicture",
  verifyToken,
  upload.single("coverPicture"),
  async (req, res) => {
    if (req.user.id === req.params.id || req.user.isAdmin) {
      try {
        const updateData = { ...req.body };
        if (req.file) {
          updateData.coverPicture = req.file.path; // Save file path or other data
        }

        await User.findByIdAndUpdate(req.params.id, { $set: updateData });
        res.status(200).json("Account has been updated");
      } catch (err) {
        return res.status(500).json(err);
      }
    } else {
      return res.status(403).json("You can only update your account!");
    }
  }
);

// Get all users for admin (Protected route for admin only)
router.get("/admin/all", verifyToken, async (req, res) => {
  if (req.user.isAdmin) {
    try {
      const users = await User.find().select("-password"); // Exclude passwords
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users", error: err });
    }
  } else {
    res.status(403).json("Access denied! Admins only.");
  }
});

// Delete user as admin
router.delete("/admin/:id", verifyToken, async (req, res) => {
  if (req.user.isAdmin) {
    try {
      await User.findByIdAndDelete(req.params.id);
      res.status(200).json("User has been deleted");
    } catch (err) {
      res.status(500).json({ message: "Error deleting user", error: err });
    }
  } else {
    res.status(403).json("Access denied! Admins only.");
  }
});

// Update user role or other details as admin
router.put("/admin/:id", verifyToken, async (req, res) => {
  if (req.user.isAdmin) {
    try {
      await User.findByIdAndUpdate(req.params.id, { $set: req.body });
      res.status(200).json("User updated successfully");
    } catch (err) {
      res.status(500).json({ message: "Error updating user", error: err });
    }
  } else {
    res.status(403).json("Access denied! Admins only.");
  }
});

// Delete user by admin
router.delete("/admin", verifyToken, async (req, res) => {
  if (req.user.isAdmin) {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    try {
      // Your logic to delete the user goes here
      await User.findByIdAndDelete(userId);
      res.status(200).json({ message: "User deleted successfully!" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting user", error });
    }
  } else {
    res.status(403).json("Access denied! Admins only.");
  }
});


module.exports = router;
