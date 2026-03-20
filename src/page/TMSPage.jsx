import TMSDashboard from "../components/TMSDashboard";

export default function TMSPage({ locale, text, refreshKey }) {
  return <TMSDashboard locale={locale} text={text} refreshKey={refreshKey} />;
}