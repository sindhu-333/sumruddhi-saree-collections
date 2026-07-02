import React, { useMemo, useState } from 'react';
import './ReturnExchangeRequestPage.css';

const MAX_VIDEO_FILES = 5;
const MAX_IMAGE_FILES = 5;
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1 GB
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100 MB

function validateFiles(files, maxCount, maxSize) {
  if (!files || files.length === 0) {
    return null;
  }

  if (files.length > maxCount) {
    return `You can upload up to ${maxCount} files.`;
  }

  const tooLarge = Array.from(files).find((file) => file.size > maxSize);
  if (tooLarge) {
    return `File ${tooLarge.name} exceeds the size limit.`;
  }

  return null;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export default function ReturnExchangeRequestPage() {
  const [formState, setFormState] = useState({
    customerName: '',
    whatsappNumber: '',
    emailAddress: '',
    orderNumber: '',
    productCode: '',
    purchaseDate: '',
    issueType: 'Product is damaged',
    problemDescription: '',
    preferredSolution: 'Exchange for same product'
  });
  const [videoFiles, setVideoFiles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const videoError = useMemo(
    () => validateFiles(videoFiles, MAX_VIDEO_FILES, MAX_VIDEO_SIZE),
    [videoFiles]
  );
  const imageError = useMemo(
    () => validateFiles(imageFiles, MAX_IMAGE_FILES, MAX_IMAGE_SIZE),
    [imageFiles]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleVideoUpload = (event) => {
    const files = Array.from(event.target.files || []);
    setVideoFiles(files);
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    setImageFiles(files);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitError('');

    if (videoFiles.length === 0 || imageFiles.length === 0) {
      setSubmitError('Please upload both unboxing video and product photos.');
      return;
    }

    if (videoError || imageError) {
      setSubmitError(videoError || imageError || 'Please fix the file upload errors.');
      return;
    }

    // Build multipart form data
    const formData = new FormData();
    formData.append('customerName', formState.customerName);
    formData.append('whatsappNumber', formState.whatsappNumber);
    formData.append('emailAddress', formState.emailAddress);
    formData.append('orderNumber', formState.orderNumber);
    formData.append('productCode', formState.productCode);
    formData.append('purchaseDate', formState.purchaseDate);
    formData.append('issueType', formState.issueType);
    formData.append('problemDescription', formState.problemDescription);
    formData.append('preferredSolution', formState.preferredSolution);

    videoFiles.forEach((f) => formData.append('videos', f));
    imageFiles.forEach((f) => formData.append('photos', f));

    setSubmitted(true);

    fetch(`${API_BASE}/returns`, {
      method: 'POST',
      body: formData
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || data.message || 'Submission failed');
        }
        return res.json();
      })
      .then((data) => {
        setSubmitted(true);
      })
      .catch((err) => {
        console.error('submit error', err);
        setSubmitError(err.message || 'Submission failed');
        setSubmitted(false);
      });
  };

  if (submitted) {
    return (
      <main className="return-form-page">
        <section className="return-form-card return-form-success">
          <h1>Samruddhi Saree Collections - Return/Exchange Request</h1>
          <p>Your request has been captured successfully.</p>
          <p>Our team will review your submission within 24 hours and contact you on WhatsApp or email.</p>
          <a className="return-form-back" href="#/">Back to Home</a>
        </section>
      </main>
    );
  }

  return (
    <main className="return-form-page">
      <section className="return-form-card">
        <h1>Samruddhi Saree Collections - Return/Exchange Request</h1>
        <p className="return-form-subtitle">Please provide details for your return/exchange request</p>
        <p className="return-form-note">
          The name, email address and photo associated with your Google Account may be recorded when you upload files and submit this form.
        </p>
        <p className="return-form-required">* Indicates required question</p>

        <form className="return-form-grid" onSubmit={handleSubmit}>
          <label>
            Customer Name *
            <input type="text" name="customerName" value={formState.customerName} onChange={handleChange} required />
          </label>

          <label>
            WhatsApp Number *
            <input type="tel" name="whatsappNumber" value={formState.whatsappNumber} onChange={handleChange} required />
          </label>

          <label>
            Email Address *
            <input type="email" name="emailAddress" value={formState.emailAddress} onChange={handleChange} required />
          </label>

          <label>
            Order Number *
            <input type="text" name="orderNumber" value={formState.orderNumber} onChange={handleChange} required />
          </label>

          <label>
            Product Code *
            <input type="text" name="productCode" value={formState.productCode} onChange={handleChange} placeholder="e.g., 001, 002, 003" required />
          </label>

          <label>
            Purchase Date *
            <input type="date" name="purchaseDate" value={formState.purchaseDate} onChange={handleChange} required />
          </label>

          <fieldset className="return-form-fieldset">
            <legend>Issue Type *</legend>
            <label className="return-form-radio">
              <input
                type="radio"
                name="issueType"
                value="Wrong product received"
                checked={formState.issueType === 'Wrong product received'}
                onChange={handleChange}
                required
              />
              Wrong product received
            </label>
            <label className="return-form-radio">
              <input
                type="radio"
                name="issueType"
                value="Product is damaged"
                checked={formState.issueType === 'Product is damaged'}
                onChange={handleChange}
              />
              Product is damaged
            </label>
          </fieldset>

          <label>
            Describe the Problem *
            <textarea
              name="problemDescription"
              value={formState.problemDescription}
              onChange={handleChange}
              rows={5}
              required
            />
          </label>

          <label>
            Unboxing Video Upload *
            <span className="return-form-help">MANDATORY: Please upload unboxing video of the product.</span>
            <span className="return-form-help">Upload up to 5 supported files: video. Max 1 GB per file.</span>
            <input type="file" accept="video/*" multiple onChange={handleVideoUpload} required />
            {videoError ? <span className="return-form-error">{videoError}</span> : null}
          </label>

          <label>
            Product Photos *
            <span className="return-form-help">Upload clear photos showing the issue.</span>
            <span className="return-form-help">Upload up to 5 supported files: image. Max 100 MB per file.</span>
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} required />
            {imageError ? <span className="return-form-error">{imageError}</span> : null}
          </label>

          <label>
            Preferred Solution *
            <select name="preferredSolution" value={formState.preferredSolution} onChange={handleChange} required>
              <option value="Exchange for same product">Exchange for same product</option>
            </select>
          </label>

          {submitError ? <p className="return-form-error return-form-submit-error">{submitError}</p> : null}

          <button type="submit" className="return-form-submit">Submit Return/Exchange Request</button>
        </form>
      </section>
    </main>
  );
}
