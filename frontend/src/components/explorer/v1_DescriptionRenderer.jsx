import React from 'react';

/**
 * Renders a WidgetDescription array (or string) as rich HTML content.
 *
 * Each WidgetDescription node may contain:
 *   - type: element type hint (h1-h6, p, ol, ul, li, code, br, blockquote, etc.)
 *   - text: the content (may contain HTML markup)
 *   - styleClasses: CSS classes to apply (string or array)
 *   - status: 'I' means inactive (skip)
 *   - nodes: nested WidgetDescription children
 */

/** Allowed HTML element types from WidgetDescription.type */
const ELEMENT_TYPES = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'div',
  'ol', 'ul', 'li',
  'code', 'pre',
  'br', 'hr',
  'blockquote',
  'strong', 'b', 'em', 'i',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a',
]);

const V1DescriptionRenderer = ({ description, className = '' }) => {
  if (!description) return null;

  // Plain string
  if (typeof description === 'string') {
    return (
      <div
        className={`description-content ${className}`}
        dangerouslySetInnerHTML={{ __html: description }}
      />
    );
  }

  // Array of WidgetDescription nodes
  if (Array.isArray(description)) {
    const activeNodes = description.filter(
      (d) => d.status !== 'I' && (d.text || d.nodes || d.type === 'br' || d.type === 'hr')
    );
    if (activeNodes.length === 0) return null;

    return (
      <div className={`description-content ${className}`}>
        {activeNodes.map((node, idx) => (
          <DescriptionNode key={node.index ?? idx} node={node} />
        ))}
      </div>
    );
  }

  return null;
};

const DescriptionNode = ({ node }) => {
  const styleClasses = Array.isArray(node.styleClasses)
    ? node.styleClasses.join(' ')
    : typeof node.styleClasses === 'string'
      ? node.styleClasses
      : '';

  // Determine the HTML element to use based on node.type
  const Tag = node.type && ELEMENT_TYPES.has(node.type) ? node.type : 'div';

  // Self-closing elements
  if (Tag === 'br' || Tag === 'hr') {
    return React.createElement(Tag);
  }

  const activeChildren = Array.isArray(node.nodes)
    ? node.nodes.filter((n) => n.status !== 'I')
    : [];

  // For list containers (ol/ul), render children as <li> items
  if ((Tag === 'ol' || Tag === 'ul') && activeChildren.length > 0) {
    return (
      <Tag className={styleClasses || undefined}>
        {node.text && (
          <li><span dangerouslySetInnerHTML={{ __html: node.text }} /></li>
        )}
        {activeChildren.map((child, idx) => (
          <DescriptionNode key={child.index ?? idx} node={child} />
        ))}
      </Tag>
    );
  }

  return (
    <Tag className={styleClasses || undefined}>
      {node.text && (
        <span dangerouslySetInnerHTML={{ __html: node.text }} />
      )}
      {activeChildren.map((child, idx) => (
        <DescriptionNode key={child.index ?? idx} node={child} />
      ))}
    </Tag>
  );
};

export default V1DescriptionRenderer;
