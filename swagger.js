const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Gold Estimation API',
            version: '1.0.0',
            description: 'API Documentation for the Gold Estimation Mobile App Backend',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local Build Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Pass the token retrieved from /api/auth/login',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    // Reads JSDoc comments from all route files
    apis: ['./routes/*.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
