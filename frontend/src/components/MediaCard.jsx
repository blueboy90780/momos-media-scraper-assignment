import React from 'react';
import { FaImage, FaVideo } from 'react-icons/fa';
import styles from '../app/page.module.css';

export default function MediaCard({ item }) {
  return (
    <div className={styles.mediaCard}>
      {item.type === 'image' ? (
        <>
          <div className={styles.mediaPreview}>
            <img 
              src={item.mediaUrl} 
              alt="Scraped content"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/file.svg';
              }}
            />
          </div>
          <FaImage className={styles.mediaIcon} />
        </>
      ) : item.type === 'video' ? (
        <div className={styles.mediaPreview}>
          <FaVideo className={styles.mediaIcon} />
        </div>
      ) : (
        <span className={styles.noMedia}>No media found</span>
      )}
      <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className={styles.mediaLink}>
        {item.mediaUrl}
      </a>
      <p className={styles.sourceLink}>
        Source: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceUrl}</a>
      </p>
    </div>
  );
}