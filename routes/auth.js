const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;

// Register
router.post("/register", async (req, res) => {
  try {
    // Hashing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Creating a new user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      status: "active", // Default status
    });

    // Saving user and returning response
    const user = await newUser.save();

    // Create JWT (includes username in the payload)
    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ user, token });
  } catch (err) {
    console.error("Error registering user:", err);
    res
      .status(500)
      .json({ message: "Error registering user", error: err.message || err });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    // Check if the request contains the usernameOrEmail field and password
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json("Please provide both username/email and password.");
    }

    // Find the user by username or email
    const user = await User.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });

    if (!user) {
      return res.status(404).json("User not found");
    }

    // Check if the user is active
    if (user.status !== "active") {
      return res
        .status(403)
        .json("Your account has been deactivated. Please contact support.");
    }

    // Validate the password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json("Wrong password");
    }

    // Create JWT (includes username in the payload)
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Respond with the user details and token
    res.status(200).json({ user, token });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err });
  }
});



// Middleware to verify token and user status
const verifyToken = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json("Access Denied");

  const token = authHeader.split(" ")[1]; // Expecting "Bearer <token>"
  if (!token) return res.status(401).json("Access Denied: Token missing");

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(verified.id);

    // Check if the user exists and is active
    if (!user || user.status !== "active") {
      return res
        .status(403)
        .json("Access denied. Your account is deactivated or not found.");
    }

    req.user = verified; // Attach user to request
    next();
  } catch (err) {
    res.status(400).json("Invalid Token");
  }
};

// Example protected route
router.get("/protected", verifyToken, (req, res) => {
  res.status(200).json("This is a protected route");
});

module.exports = router;
