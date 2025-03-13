import React from 'react';
import { FaSearch } from 'react-icons/fa';
import styles from '../app/page.module.css';

export default function MediaControls({ searchTerm, onSearchChange, filter, onFilterChange }) {
  return (
    <div className={styles.controls}>
      <div className={styles.search}>
        <FaSearch />
        <input
          type="text"
          placeholder="Search media..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className={styles.filterControls}>
        <select value={filter} onChange={(e) => onFilterChange(e.target.value)}>
          <option value="">All Media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
      </div>
    </div>
  );
}