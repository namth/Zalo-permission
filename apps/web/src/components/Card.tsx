import React from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Card({ title, description, children, className }: CardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className || ''}`}>
      {(title || description) && (
        <div className="border-b border-gray-200 px-6 py-4">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
