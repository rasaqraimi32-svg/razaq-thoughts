import { publicPageMetadata } from "@/lib/site-metadata";
import ContactForm from "@/components/ContactForm";

export const metadata = publicPageMetadata("/contact", "Contact", "Get in touch with Razaq about an article, a question or an idea.");

export default function ContactPage() {
  return <div className="container contact-page"><header className="page-intro"><p className="eyebrow category-label">Get in touch</p><h1>Every conversation<br /><em>starts somewhere.</em></h1><p>Have a question, a reading suggestion or a different perspective? I’d like to hear what’s on your mind.</p></header><div className="contact-layout"><aside className="contact-aside"><h2>A note to Razaq</h2><p>Use this space for general questions, feedback about an article, or an idea you would like to see explored.</p><div className="contact-aside-note"><p className="eyebrow category-label">Thoughtfulness goes both ways</p><p>Be clear, be considerate, and share only what you’re comfortable making part of a conversation.</p></div><p className="muted-note">Contact is not open yet. This page previews the form that will be available when messaging is enabled.</p></aside><ContactForm /></div></div>;
}
