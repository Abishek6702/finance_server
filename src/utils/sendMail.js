const nodemailer = require("nodemailer");

const sendMail = async (to, subject, html, attachmentPath = null) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to,
    subject,
    html,
  };

  if (attachmentPath) {
    mailOptions.attachments = [
      {
        filename: attachmentPath.split("/").pop(), 
        path: attachmentPath,
      },
    ];
  }

  await transporter.sendMail(mailOptions);
};

module.exports = sendMail;
