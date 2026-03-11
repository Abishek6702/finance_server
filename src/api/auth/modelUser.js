const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const BCRYPT_SALT_ROUNDS = process.env.JEST_WORKER_ID ? 1 : 10;

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "superadmin", "user"],
      default: "user",
    },
  },
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
});

module.exports = mongoose.model("User", UserSchema);
