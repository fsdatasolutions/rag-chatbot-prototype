// backend/utils/sanitize.js
const sanitizeHtml = require('sanitize-html');

const sanitizeResponse = (html) => {
    return sanitizeHtml(html, {
        allowedTags: ['ol', 'ul', 'li', 'strong', 'em', 'br', 'img', 'p'],
        allowedAttributes: {
            img: ['src', 'alt']
        },
        allowedSchemes: ['https']
    });
};

module.exports = sanitizeResponse;
