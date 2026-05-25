import React from 'react';
import TMSDashboard from '../../components/TMSDashboard';

export default function AdminPage({ locale = 'en' }) {
  return <TMSDashboard locale={locale} />;
}
