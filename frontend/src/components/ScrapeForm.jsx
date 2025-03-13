import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import styles from '../app/page.module.css';

export default function ScrapeForm({ urls, onUrlsChange, onScrape, onClearAll, loading }) {
  return (
    <section className={styles.scrapeSection}>
      <h2>Submit URLs for Scraping</h2>
      <form onSubmit={onScrape} className={styles.form}>
        <textarea
          placeholder="Enter URLs (one per line)"
          value={urls}
          onChange={(e) => onUrlsChange(e.target.value)}
          required
        />
        <div className={styles.buttonGroup}>
          <button type="submit" disabled={loading}>
            {loading ? <FaSpinner className={styles.spinner} /> : 'Scrape URLs'}
          </button>
          <button type="button" disabled={loading} onClick={onClearAll}>
            Clear All
          </button>
        </div>
      </form>
    </section>
  );
}