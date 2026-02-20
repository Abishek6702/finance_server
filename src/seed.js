const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const connectDB = require("./config/db");
const User = require("./models/User");

dotenv.config();

const seedUsers = async () => {
  try {
    await connectDB();

    const users = [
      {
        name: "Admin",
        email: "admin@sece.ac.in",
        password: "admin@123",
        role: "admin",
      },
      {
        name: "Super Admin",
        email: "superadmin@sece.ac.in",
        password: "superadmin@123",
        role: "superadmin",
      },
    ];

    for (const user of users) {
      const existingUser = await User.findOne({ email: user.email });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await User.create({
          name: user.name,
          email: user.email,
          password: hashedPassword,
          role: user.role,
        });
        console.log(`${user.role} created successfully: ${user.email}`);
      } else {
        console.log(`${user.role} already exists: ${user.email}`);
      }
    }

    console.log("Seeding finished.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding users:", error);
    process.exit(1);
  }
};

seedUsers();
