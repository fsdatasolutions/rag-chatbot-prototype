const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');
const cheerio = require('cheerio');
const { extname } = require('path');
const { Readable } = require('stream');

function extractTextFromBuffer(buffer, fileName) {
    const ext = extname(fileName).toLowerCase();

    switch (ext) {
        case '.pdf':
            return pdfParse(buffer).then(data => data.text);

        case '.docx':
            return mammoth.extractRawText({ buffer }).then(result => result.value);

        case '.txt':
        case '.md':
            return Promise.resolve(buffer.toString('utf-8'));

        case '.xlsx': {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let text = '';
            workbook.SheetNames.forEach(sheet => {
                const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 });
                rows.forEach(row => {
                    text += row.join(' ') + '\n';
                });
            });
            return Promise.resolve(text);
        }

        case '.csv': {
            return new Promise((resolve, reject) => {
                let text = '';
                const stream = Readable.from(buffer.toString());
                stream
                    .pipe(parse())
                    .on('data', row => {
                        text += Object.values(row).join(' ') + '\n';
                    })
                    .on('end', () => resolve(text))
                    .on('error', reject);
            });
        }

        case '.html': {
            const html = buffer.toString();
            const $ = cheerio.load(html);
            return Promise.resolve($('body').text());
        }

        default:
            throw new Error(`Unsupported file type: ${fileName}`);
    }
}

module.exports = extractTextFromBuffer;