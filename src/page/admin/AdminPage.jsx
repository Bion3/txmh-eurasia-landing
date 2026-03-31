import React from 'react';
import TMSDashboard from '../../components/TMS/TMSDashboard';

export default function AdminPage({ locale = 'en' }) {
  return <TMSDashboard locale={locale} />;
}