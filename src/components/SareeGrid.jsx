import React from 'react';
import SareeCard from './SareeCard';
import './SareeGrid.css';

const SareeGrid = ({ title = 'New Arrivals', sarees = [], onAdd, onOpenDetails, getAverageRating, getRatingCount }) => {
  return (
    <section className="saree-grid-section">
      <div className="grid-header">
        <h2 className="grid-title">{title}</h2>
        <p className="grid-subtitle">Handpicked sarees just for you</p>
      </div>

      {sarees.length === 0 ? (
        <p className="empty-state">No sarees available.</p>
      ) : (
        <div className="saree-grid">
          {sarees.map((saree, index) => (
            <div
              key={saree.id}
              className="grid-item"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <SareeCard
                saree={saree}
                onAdd={onAdd}
                onOpenDetails={onOpenDetails}
                isNew={saree.isNew}
                getAverageRating={getAverageRating}
                getRatingCount={getRatingCount}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default SareeGrid;