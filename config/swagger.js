const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Finance Server API",
      version: "1.0.0",
      description: "API documentation for Finance Server",
    },
    servers: [
      {
        url: "http://localhost:5000",
      },
    ],
  },
  apis: ["./routes/*.js"], // path to route files
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
