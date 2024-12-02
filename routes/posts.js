const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

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

// Configure Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads"); // Save files to the "uploads" directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimeType = fileTypes.test(file.mimetype);

    if (extname && mimeType) {
      return cb(null, true);
    } else {
      cb("Error: Images Only!");
    }
  },
});

// Create a post (Protected route)
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  const { title, category } = req.body;

  // Validate title and category
  if (!title || !category) {
    return res.status(400).json("Title and category are required");
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null; // Save image path if uploaded

  const newPost = new Post({
    ...req.body,
    userId: req.user.id,
    image: imagePath,
  });

  try {
    const savedPost = await newPost.save();
    res.status(200).json(savedPost);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Fetch all posts (Public route)
router.get("/all", async (req, res) => {
  try {
    const posts = await Post.find(); // Fetch all posts
    if (!posts.length) {
      return res.status(404).json("No posts found");
    }
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});


// Update a post (Protected route)
router.put("/:id", verifyToken, upload.single("image"), async (req, res) => {
  const { title, category } = req.body;

  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    if (post.userId === req.user.id) {
      // Update post data
      const updates = { ...req.body };

      // Check for image upload
      if (req.file) {
        updates.image = `/uploads/${req.file.filename}`;
      }

      // Validate title and category if being updated
      if (title !== undefined && !title.trim()) {
        return res.status(400).json("Title cannot be empty");
      }
      if (category !== undefined && !category.trim()) {
        return res.status(400).json("Category cannot be empty");
      }

      await post.updateOne({ $set: updates });
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

    // Allow deletion if the user is the owner of the post or an admin
    if (post.userId === req.user.id || req.user.isAdmin === true) {
      await post.deleteOne();
      res.status(200).json("The post has been deleted");
    } else {
      res.status(403).json("You can only delete your own post or you need admin privileges");
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

/*
// Get a post (Public route) (ERROR HERE)
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
*/

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

// Get all posts by a specific user (Protected route)
router.get("/user/:userId", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId; // Extract the userId from the request parameters

    // Find all posts where userId matches the specified user
    const userPosts = await Post.find({ userId });

    if (userPosts.length === 0) {
      return res.status(404).json("No posts found for this user");
    }

    res.status(200).json(userPosts);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Search posts (Protected route)
/*router.get("/search" , verifyToken , async (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json("Invalid or missing query string");
  }

  console.log("Query received:", query); // Log the incoming query

  try {
    const searchCriteria = {
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } }
      ]
    };

    console.log("Executing search query:", searchCriteria); // Log the query object

    const posts = await Post.find(searchCriteria).select("-_id"); // Exclude _id
    console.log("Found posts:", posts); // Log found posts or an empty array if no posts found

    res.status(200).json(posts);
  } catch (err) {
    console.error("Error during search:", err.stack); // Log the full error stack
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
});
*/

// Search posts by followers (with advanced filtering) - Protected route
router.get("/search", verifyToken, async (req, res) => {
  const { query, filter, sort } = req.query;

  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build search criteria
    let searchCriteria = {};

    if (query && typeof query === "string") {
      searchCriteria.$or = [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ];
    }

    // Apply filter based on the `filter` parameter
    if (filter === "exclude-my-posts") {
      searchCriteria.userId = { $in: currentUser.followings };
    } else if (filter === "only-my-posts") {
      searchCriteria.userId = currentUser._id;
    } else {
      searchCriteria.userId = { $in: [currentUser._id, ...currentUser.followings] };
    }

    // Sort logic
    let sortOption = {};
    if (sort === "username") {
      sortOption = { username: 1 }; // Ascending username
    } else if (sort === "date") {
      sortOption = { createdAt: -1 }; // Descending date
    } else {
      sortOption = { title: 1 }; // Default: ascending title
    }

    // Fetch posts based on criteria and sort
    const posts = await Post.find(searchCriteria).sort(sortOption);

    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});



// Add a comment to a post (Protected route)
router.post("/:id/comment", verifyToken, async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json("Comment text is required");
  }

  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = {
      userId: req.user.id,
      username: req.user.username, // Ensure the token includes the username or retrieve it from the User model
      text: text.trim(),
    };

    post.comments.push(comment);
    await post.save();

    res.status(201).json({ message: "Comment added", comment });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all comments for a post (Public route)
router.get("/:id/comments", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    res.status(200).json(post.comments);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Delete a comment (Protected route)
router.delete("/:id/comment/:commentId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    if (comment.userId !== req.user.id) {
      return res.status(403).json("You can only delete your own comments");
    }

    comment.remove();
    await post.save();

    res.status(200).json("Comment deleted");
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
