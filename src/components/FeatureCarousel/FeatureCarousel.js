import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarCheck2, MapPinned, Search } from "lucide-react";
import "./FeatureCarousel.css";

const slides = [
  { title: "Doctors, trainers, interviewers and more", text: "Nexus brings different kinds of resources into one simple discovery flow.", image: "/images/doctor.svg", label: "Doctor" },
  { title: "Find the right fit before you book", text: "Search by resource type, provider, name, meeting mode and the day or time you need.", image: "/images/interviewer.svg", label: "Interviewer" },
  { title: "Nearby offline resources", text: "When you choose an offline meeting, Nexus can use your current location to find resources within your preferred distance.", image: "/images/trainer.svg", label: "Trainer" },
  { title: "See availability like a calendar", text: "Open a resource profile, review the available slots and choose the time that works for you.", image: "/images/calendar.svg", label: "Availability" },
];

const icons = [Search, MapPinned, CalendarCheck2, CalendarCheck2];

export default function FeatureCarousel() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const Icon = icons[index];

  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="feature-carousel">
      <div className="feature-image-wrap">
        <div className="feature-image-backdrop" />
        <img src={slide.image} alt={slide.label} className="feature-image" />
        <span className="feature-image-tag"><Icon size={14} /> {slide.label}</span>
      </div>
      <div className="feature-copy">
        <span className="section-kicker">HOW NEXUS WORKS</span>
        <h2>{slide.title}</h2>
        <p>{slide.text}</p>
        <div className="carousel-controls">
          <button onClick={() => setIndex((index - 1 + slides.length) % slides.length)} aria-label="Previous"><ArrowLeft size={17} /></button>
          <div className="carousel-dots">
            {slides.map((item, itemIndex) => <button key={item.label} className={itemIndex === index ? "active" : ""} onClick={() => setIndex(itemIndex)} aria-label={`Slide ${itemIndex + 1}`} />)}
          </div>
          <button onClick={() => setIndex((index + 1) % slides.length)} aria-label="Next"><ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}
