import React from 'react';
import './PolicyModal.css';

const POLICIES = {
  returns: {
    title: "Returns & Exchange Policy",
    content: `At Samruddhi Saree Collections, we take great care in ensuring the quality of our products. However, in the unlikely event that you receive a damaged, defective, or incorrect item, our Exchange Policy applies as follows:

## 1. Eligibility for Returns & Exchanges

✅ **Exchanges are accepted only in cases of:**
- Products damaged during shipping
- Manufacturing defects
- Incorrect item sent
- Exchange requests must be submitted within 2 days of delivery of the saree

🚫 **Returns/Exchanges are not accepted for:**
- Change of mind
- Size or color preference
- General dissatisfaction with the product

## 2. Mandatory Evidence Requirement

To process any return or exchange request, you must provide:
- An unboxing video clearly showing the damage at the time of opening
- Clear photographs of the damaged or defective product
- Your Order Number and Product Code

⚠️ **Important:** Requests without an unboxing video will not be considered.

## 3. How to Report a Damaged Product

Please submit your request using our Returns Form at:
LINK:Return/Exchange Request Form|#/return-exchange-request

**Form details required:**
- Order number and product code
- Description of damage/issue
- Upload of unboxing video and supporting images

## 4. Review & Processing Timeline

- All requests are reviewed within 24 hours of submission
- If approved, only an exchange will be initiated
- Approval is granted only after verification of the submitted evidence
- Exchange processing and dispatch will be completed within 3–4 business days after approval

🚫 **Please note:** We do not offer refunds. Only product exchanges are initiated for eligible cases.

## 5. Assistance

For any questions or concerns regarding returns and exchanges, please contact us at:
📧 samruddhisareecollections@gmail.com`
  },
  shipping: {
    title: "Shipping Policy",
    content: `At Samruddhi Saree Collections, we take great care in ensuring the quality of our products. However, in the unlikely event that you receive a damaged, defective, or incorrect item, our Returns & Exchange Policy applies as follows:

## Shipping Area

- We currently ship across all serviceable pin codes within India
- International shipping is not available at this time

## Shipping Charges

We are delighted to offer **FREE shipping on all over INDIA**.

## Dispatch & Delivery

- Orders dispatched within 2–3 business days of confirmation
- Delivery typically within 3–4 business days, depending on location
- Tracking details provided once the order is shipped

## Notes

- Delivery timelines may vary due to courier delays, festive seasons, or remote locations
- Please ensure that shipping details provided at checkout are accurate to avoid delays
- If the package is missing or delivered to a location not mentioned in your provided shipping information, refunds will be processed only by the delivery partner`
  },
  privacy: {
    title: "Privacy Policy",
    content: `At Samruddhi Saree Collections, we take great care in ensuring the quality of our products. However, in the unlikely event that you receive a damaged, defective, or incorrect item, our Returns & Exchange Policy applies as follows:

## Information We Collect

- Name, email, phone number, billing and shipping addresses
- Order details and payment information (processed securely through third-party gateways; not stored by us)
- Photos or unboxing videos provided for return/exchange verification
- Technical data such as IP address, browser type, device info, and cookies for analytics

## How We Use Your Information

- To process and deliver orders
- To provide customer support
- To verify product exchange requests (including unboxing video proof)
- To send order updates and service notifications
- To improve our website and services

## Sharing of Information

We do not sell or rent personal data. Information is shared only with:
- Payment processors (to complete secure transactions)
- Delivery partners (to ship your order)
- Service providers (for hosting, analytics, or support)
- Legal authorities if required by law

## Cookies

Our website may use cookies to enhance functionality and analyze traffic. You may disable cookies in your browser, though some features may be affected.

## Data Retention

Your data is retained only as long as necessary to complete your order, handle exchanges, and comply with legal obligations.

## Your Rights

You may request access, correction, or deletion of your data by contacting us at samruddhisareecollections@gmail.com`
  }
};

export default function PolicyModal({ isOpen, policyType, onClose }) {
  if (!isOpen || !policyType || !POLICIES[policyType]) {
    return null;
  }

  const policy = POLICIES[policyType];

  return (
    <>
      <div className="policy-modal-backdrop" onClick={onClose} />
      <div className="policy-modal">
        <div className="policy-modal-header">
          <h2 className="policy-modal-title">{policy.title}</h2>
          <button 
            type="button" 
            className="policy-modal-close" 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="policy-modal-content">
          {policy.content.split('\n').map((line, idx) => {
            if (line.startsWith('LINK:')) {
              const value = line.replace('LINK:', '');
              const [label, href] = value.split('|');
              return (
                <p key={idx} className="policy-paragraph">
                  <a href={href || '#'} className="policy-inline-link" onClick={onClose}>
                    {label || 'Open form'}
                  </a>
                </p>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <h3 key={idx} className="policy-section-heading">
                  {line.replace('## ', '')}
                </h3>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <li key={idx} className="policy-list-item">
                  {line.replace('- ', '')}
                </li>
              );
            }
            if (line.trim() === '') {
              return <div key={idx} className="policy-spacer" />;
            }
            return (
              <p key={idx} className="policy-paragraph">
                {line}
              </p>
            );
          })}
        </div>
        <div className="policy-modal-footer">
          <button 
            type="button" 
            className="policy-close-button" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
