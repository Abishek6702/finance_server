const welcome = require("./mailTemplates/welcomeMail");
const enquiry = require("./mailTemplates/enquiryMail");
const forgotPassword = require("./mailTemplates/forgotPassword");
const application = require("./mailTemplates/application")
const remark = require("./mailTemplates/remark")


const templates = {
  welcome,
  enquiry,
  forgotPassword,
  application ,
  remark,
 
};

function renderTemplate(templateName, data) {
  const templateFn = templates[templateName];
  if (!templateFn) {
    throw new Error(`Template "${templateName}" not found`);
  }
  return templateFn(data);
}

module.exports = renderTemplate;
