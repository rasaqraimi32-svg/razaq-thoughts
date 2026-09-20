"use client";

import { useState } from "react";
import Arrow from "./Arrow";

export default function ContactForm() {
  const [message, setMessage] = useState("");
  return <form className="contact-form" aria-describedby="contact-preview" onSubmit={event => { event.preventDefault(); setMessage("This is a preview form. Your message has not been sent or stored."); }}>
    <p id="contact-preview" className="demo-notice">Form preview — messages cannot be sent yet. Please use sample details.</p>
    <div className="form-row"><div className="form-field"><label htmlFor="contact-name">Name <span>(required)</span></label><input id="contact-name" name="name" autoComplete="name" placeholder="Your name" maxLength={100} required /></div><div className="form-field"><label htmlFor="contact-email">Email <span>(required)</span></label><input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></div></div>
    <div className="form-field"><label htmlFor="contact-subject">Subject <span>(required)</span></label><input id="contact-subject" name="subject" placeholder="What would you like to talk about?" maxLength={200} required /></div>
    <div className="form-field"><label htmlFor="contact-message">Message <span>(required)</span></label><textarea id="contact-message" name="message" rows={7} placeholder="Share your thoughts…" maxLength={5000} required /></div>
    <button className="button" type="submit">Submit message <Arrow /></button><p className="form-status" role="status">{message}</p>
  </form>;
}
