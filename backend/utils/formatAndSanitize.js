// backend/utils/formatAndSanitize.js
const sanitizeHtml = require('sanitize-html');
function formatStepsToList(text) {
  const steps = text.split(/\n\d+\.\s/).map(s => s.trim()).filter(Boolean);
  if (steps.length < 2) return text;

  const firstMatch = text.match(/^\d+\.\s(.*)/);
  if (firstMatch) steps[0] = firstMatch[1].trim();

  const listItems = steps.map(step => `<li>${step}</li>`).join('');
  return `<ol>${listItems}</ol>`;
}

function spaceImages(text) {
  return text.replace(/<img /g, '<br/><img ').replace(/<\/img>/g, '</img><br/>');
}

function addLineBreaks(text) {
  return text.replace(/\n/g, '<br/>');
}

function formatAndSanitize(rawText) {

  const formatted = addLineBreaks(spaceImages(formatStepsToList(rawText)));
  return sanitizeHtml(formatted, {
    allowedTags: ['ol', 'ul', 'li', 'strong', 'em', 'br', 'img', 'p'],
    allowedAttributes: {
      img: ['src', 'alt']
    },
    allowedSchemes: ['https']
  });
}

module.exports = formatAndSanitize;
