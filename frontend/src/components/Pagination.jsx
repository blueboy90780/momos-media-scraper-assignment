import React from 'react';
import styles from '../app/page.module.css';

export default function Pagination({ page, totalPages, onPageChange, loading }) {
  return (
    <div className={styles.pagination}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1 || loading}
      >
        Previous
      </button>
      <span>Page {page} of {totalPages || 1}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loading}
      >
        Next
      </button>
    </div>
  );
}