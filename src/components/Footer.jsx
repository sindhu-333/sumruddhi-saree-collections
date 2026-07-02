import React from 'react';
import logo from '../logo.jpeg';
import './Footer.css';

export default function Footer({ onOpenPolicy }) {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section footer-brand">
          <div className="footer-logo">
            <img src={logo} alt="Samruddhi Saree Collections logo" className="footer-logo-image" />
          </div>
          <p className="footer-tagline">Brand loved by all</p>
        </div>

        <div className="footer-section footer-contact" id="footer-contact-details">
          <h4 className="footer-section-title">Contact</h4>
          <div className="contact-info">
            <p className="contact-item">
              <span className="contact-icon">📍</span>
              <a href="https://www.google.com/search?q=map%20of%20Bettalli%20Maramma%20Temple%20St%2C%20Hanur%2C%20Karnataka%20571439&shem=rimspwouoe&shndl=40&source=sh%2Fx%2Floc%2Fgeo%2Fm1%2F4&kgs=3287260cec99a04f" target="_blank" rel="noopener noreferrer" className="contact-link">
                Bettalli Maramma Temple St, Hanur, Karnataka
              </a>
            </p>
            <p className="contact-item">
              <span className="contact-icon">📧</span>
              <a href="mailto:samruddhisareecollections@gmail.com" className="contact-link">
                samruddhisareecollections@gmail.com
              </a>
            </p>
            <p className="contact-item">
              <span className="contact-icon">📱</span>
              <a href="tel:6360345856" className="contact-link">
                +91 6360345856
              </a>
            </p>
            <p className="contact-item">
              <span className="contact-icon">📱</span>
              <a href="tel:9739827877" className="contact-link">
                +91 9739827877
              </a>
            </p>
          </div>
        </div>

        <div className="footer-section footer-social">
          <h4 className="footer-section-title">Follow</h4>
          <div className="social-links">
            <a href="https://www.instagram.com/samruddhi_saree_collections?igsh=eTZheWh1MWRhbWp3" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
              <i className="fab fa-instagram social-icon" aria-hidden="true"></i>
            </a>
            <a href="https://www.facebook.com/share/18ZKqueFFT/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Facebook">
              <i className="fab fa-facebook-f social-icon" aria-hidden="true"></i>
            </a>
            <a href="https://youtube.com/@geethabalachandrageethabal9103?si=s5lvQJ68odP3C2to" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="YouTube">
              <i className="fab fa-youtube social-icon" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">© 2025 by Samruddhi Saree Collections. All rights reserved.</p>
        <div className="footer-bottom-links">
          <button type="button" className="footer-bottom-link" onClick={() => onOpenPolicy?.('shipping')}>Shipping Policy</button>
          <span className="divider">•</span>
          <button type="button" className="footer-bottom-link" onClick={() => onOpenPolicy?.('returns')}>Return Policy</button>
          <span className="divider">•</span>
          <button type="button" className="footer-bottom-link" onClick={() => onOpenPolicy?.('privacy')}>Privacy Policy</button>
        </div>
      </div>
    </footer>
  );
}
