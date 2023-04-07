import React, { useState, useMemo } from 'react';
import Link from '@docusaurus/Link';

import styles from './styles.module.css';

export function DocCardList({title, sections }) {
  const [filterString, setFilterString] = useState('');

  const normalize = s => s?.toLowerCase().replace(/-/g, ' ');
  const matches = text => normalize(text)?.includes(filterString);

  const handleFilterChange = event => {
    setFilterString(normalize(event.target.value));
  };

  const filteredLists = useMemo(
    () =>
      sections
        .map(section => {
          // section title match
          if (matches(section.label)) {
            return section;
          }
          // filter groups
          const matchedGroups = section.items
            .map(item => {
              // group title match
              if (matches(item.label)) {
                return item;
              }
              // filter headers
              const matchedHeaders = item.customProps.headers.filter(
                ({ value }) => matches(value)
              );
              return matchedHeaders.length
                ? {
                    label: item.label,
                    href: item.href,
                    customProps: { headers: matchedHeaders },
                  }
                : null;
            })
            .filter(i => i);

          return matchedGroups.length
            ? { label: section.label, items: matchedGroups }
            : null;
        })
        .filter(i => i),
    [sections, filterString]
  );

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1>{title}</h1>
        <div className={styles.filter}>
          <label htmlFor="filter-bar">Filter</label>
          <input
            id="filter-bar"
            type="search"
            placeholder="Enter keyword"
            value={filterString}
            onChange={handleFilterChange}
          />
        </div>
      </div>

      {filteredLists.length ? (
        filteredLists.map(({ label, items }) => {
          return (
            <div className={styles.section} key={label}>
              <h2>{label}</h2>
              <div className={styles.groups}>
                {items.map(({ label, customProps: { headers }, href }) => {
                  return (
                    <div className={styles.group} key={label}>
                      <Link to={href}>
                        <h3>{label}</h3>
                      </Link>
                      <ul>
                        {headers.map(({ anchor, value }) => {
                          return (
                            <li key={anchor}>
                              <Link to={`${href}#${anchor}`}>{value}</Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className={styles.noMatch}>
          No API matching "{filterString}" found.
        </div>
      )}
    </div>
  );
}
