import React from 'react';
import styles from '../app/page.module.css';

export default function SubmittedLinks({ links }) {
  return (
    <section className={styles.submittedLinksSection}>
      <h2>Submitted Links</h2>
      {links.length > 0 ? (
        <ul className={styles.submittedLinksList}>
          {links.map((urlObj, index) => (
            <li key={`${urlObj.url}-${index}`}>
              <a href={urlObj.url} target="_blank" rel="noopener noreferrer">
                {urlObj.url}
              </a>
              <span className={`${styles.status} ${styles[`status-${urlObj.status}`]}`}>
                {urlObj.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No links submitted yet</p>
      )}
    </section>
  );
}