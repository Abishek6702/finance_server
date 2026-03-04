const User = require("./api/auth/model.user");

const seedUsers = async () => {
  const users = [
    {
      name: "Super Admin",
      email: "superadmin@sece.ac.in",
      password: "superadmin@123",
      role: "superadmin",
    },
    {
      name: "Admin",
      email: "admin@sece.ac.in",
      password: "admin@123",
      role: "admin",
    },
  ];

  for (const user of users) {
    const exists = await User.findOne({ email: user.email });
    if (!exists) {
      await User.create(user);
    }
  }
};

module.exports = seedUsers;