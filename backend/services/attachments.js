/**
 * Chat attachments (guest app concierge chat and FAY OS Communications): one multipart upload endpoint.
 *
 *   POST <mount>  multipart field "file"  →  { url, name, type: 'image' | 'document', mimeType, size }
 *
 * Mounted at /api/chat/attachments (any signed-in user) and /api/manager/attachments (FAY OS).
 * Files are stored under uploads/chat with a generated name; the real type is checked from the file's first bytes,
 * not trusted from the client. Images up to 10 MB, PDFs and Word documents too.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const DIR = path.join(__dirname, '..', 'uploads', 'chat');
const MAX = 10 * 1024 * 1024;

/** Magic numbers → [mimeType, extension, kind]. */
function sniff(buf) {
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return ['image/jpeg', '.jpg', 'image'];
  if (hex.startsWith('89504e47')) return ['image/png', '.png', 'image'];
  if (hex.startsWith('47494638')) return ['image/gif', '.gif', 'image'];
  if (hex.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP') return ['image/webp', '.webp', 'image'];
  const ftyp = buf.subarray(4, 12).toString();
  if (/^ftyp(heic|heix|mif1|msf1|hevc)/.test(ftyp)) return ['image/heic', '.heic', 'image'];
  if (hex.startsWith('25504446')) return ['application/pdf', '.pdf', 'document'];
  if (hex.startsWith('504b0304')) return ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx', 'document'];
  if (hex.startsWith('d0cf11e0')) return ['application/msword', '.doc', 'document'];
  return null;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX, files: 1 } }).single('file');

/** Saves a buffer that passed sniff(); returns the attachment descriptor. */
async function store(buffer, originalName, userId) {
  const kind = sniff(buffer);
  if (!kind) {
    const e = new Error('Send a photo (JPEG, PNG, WebP, HEIC) or a PDF / Word document');
    e.status = 415;
    throw e;
  }
  const [mimeType, ext, type] = kind;
  await fs.promises.mkdir(DIR, { recursive: true });
  const stored = `${userId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  await fs.promises.writeFile(path.join(DIR, stored), buffer);
  const name = String(originalName || `attachment${ext}`).replace(/[\\/\r\n"]/g, '_').slice(0, 120);
  return { url: `/uploads/chat/${stored}`, name, type, mimeType, size: buffer.length };
}

/**
 * Saves an image for managed content (estate photos, 360° panoramas, story covers) under uploads/<dir>.
 * Images only; returns the public URL.
 */
async function storeImage(buffer, dir, userId) {
  const kind = sniff(buffer);
  if (!kind || kind[2] !== 'image') {
    const e = new Error('Upload a JPEG, PNG or WebP image');
    e.status = 415;
    throw e;
  }
  const target = path.join(__dirname, '..', 'uploads', dir);
  await fs.promises.mkdir(target, { recursive: true });
  const stored = `${userId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${kind[1]}`;
  await fs.promises.writeFile(path.join(target, stored), buffer);
  return `/uploads/${dir}/${stored}`;
}

/** Express handler for content images: multipart "file", up to 25 MB (360° panoramas are large). */
function imageHandler(dir) {
  const one = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } }).single('file');
  return (req, res) =>
    one(req, res, async (err) => {
      if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Images can be up to 25 MB' : err.message });
      if (!req.file) return res.status(400).json({ message: 'Choose an image' });
      try {
        res.status(201).json({ url: await storeImage(req.file.buffer, dir, req.user.id) });
      } catch (e) {
        res.status(e.status || 500).json({ message: e.status ? e.message : 'Could not save the image' });
      }
    });
}

/** Express handler (after authentication). */
function handler(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({ success: false, message: tooBig ? 'Files can be up to 10 MB' : err.message });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a file to send' });
    try {
      const attachment = await store(req.file.buffer, req.file.originalname, req.user.id);
      res.status(201).json({ success: true, attachment });
    } catch (e) {
      res.status(e.status || 500).json({ success: false, message: e.status ? e.message : 'Could not save the file' });
    }
  });
}

/**
 * The attachment to store with a message, from what a client sent: only files we stored ourselves
 * (/uploads/chat/...) are accepted, so a message can never point at an arbitrary URL.
 */
function clean(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const url = String(attachment.url || '');
  if (!/^\/uploads\/chat\/[\w.-]+$/.test(url) || !fs.existsSync(path.join(DIR, path.basename(url)))) return null;
  const type = attachment.type === 'document' ? 'document' : 'image';
  return { url, name: String(attachment.name || path.basename(url)).slice(0, 120), type, mimeType: String(attachment.mimeType || '').slice(0, 100) || undefined, size: Number(attachment.size) || undefined };
}

module.exports = { handler, store, clean, sniff, storeImage, imageHandler };
