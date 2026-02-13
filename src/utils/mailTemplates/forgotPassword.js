module.exports = ({ studentName, email, otp, frontendUrl }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://res.cloudinary.com/dfeplguf8/image/upload/v1757761491/sece-logo_fnwecc.png" alt="College Logo" style="width:120px; margin-bottom: 10px;" />
      <h2 style="color: #2c3e50;">Password Reset Request</h2>
    </div>

    <p>Dear <b>${studentName || "User"}</b>,</p>
    <p>We received a request to reset the password for your SECE Admission Portal account (<b>${email}</b>).</p>

    <p style="margin-top:20px;">Please use the OTP below to reset your password:</p>

    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:15px; text-align:center; margin:20px 0;">
      <p style="font-size:22px; letter-spacing:4px; font-weight:bold; color:#2c3e50;">${otp}</p>
      <p style="color:#888; font-size:14px; margin-top:5px;">This OTP will expire in 10 minutes.</p>
    </div>

    <p>👉 Reset your password here: <a href="${frontendUrl}/reset-password">${frontendUrl}/reset-password</a></p>

    <p style="margin-top:20px; color:#888; font-size:14px;">
      If you did not request this, please ignore this email. Your password will remain unchanged.
    </p>

    <p style="text-align:center; margin-top:30px; color:#888;">
      Regards,<br>
      <b>SECE Admissions Team</b>
    </p>
  </div>
`;
