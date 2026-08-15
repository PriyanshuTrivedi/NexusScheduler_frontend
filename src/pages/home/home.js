import React from "react";
import { ArrowRight, CalendarCheck2, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import FeatureCarousel from "../../components/FeatureCarousel/FeatureCarousel";
import "./home.css";

const categories = [
  ["Doctor", "/images/doctor.svg"],
  ["Psychologist", "/images/psychologist.svg"],
  ["Trainer", "/images/trainer.svg"],
  ["Interviewer", "/images/interviewer.svg"],
];

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();

  const role = String(user?.role || "").toLowerCase();

  const isResource =
    isAuthenticated &&
    (role === "resource" || role.includes("resource"));

  const isClient =
    isAuthenticated &&
    (role === "client" || role.includes("client"));

  if (loading) {
    return null;
  }

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="hero-badge">RESOURCE SCHEDULING, SIMPLIFIED</span>

          {isResource ? (
            <>
              <h1>
                Stay on top.
                <br />
                <span>Know what&apos;s next.</span>
                <br />
                Get it done.
              </h1>

              <p>
                Keep track of your upcoming meetings and manage your schedule
                from one place.
              </p>

              <div className="hero-actions">
                <Link
                  className="button button-primary button-large"
                  to="/bookings"
                >
                  Upcoming events <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1>
                Find someone.
                <br />
                <span>Pick a time.</span>
                <br />
                Get it done.
              </h1>

              <p>
                Nexus Scheduler helps you discover the right resource,
                understand their availability and schedule a meeting without
                the back-and-forth.
              </p>

              <div className="hero-actions">
                <Link
                  className="button button-primary button-large"
                  to="/resources"
                >
                  Find a resource <ArrowRight size={18} />
                </Link>

                {isClient ? (
                  <Link
                    className="button button-quiet button-large"
                    to="/bookings"
                  >
                    My events
                  </Link>
                ) : (
                  <Link
                    className="button button-quiet button-large"
                    to="/register"
                  >
                    Create an account
                  </Link>
                )}
              </div>
            </>
          )}

          <div className="hero-trust">
            <span>
              <ShieldCheck size={16} /> Secure account access
            </span>
            <span>
              <CalendarCheck2 size={16} /> Calendar-based scheduling
            </span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-blob" />

          <img
            className="hero-calendar-image"
            src="/images/calendar.svg"
            alt="Calendar availability"
          />

          <div className="floating-card floating-search">
            <Search size={18} />

            <div>
              <strong>
                {isResource ? "Your schedule" : "Find a resource"}
              </strong>

              <small>
                {isResource
                  ? "Upcoming meetings and availability"
                  : "Doctors, trainers, interviewers…"}
              </small>
            </div>
          </div>

          <div className="floating-card floating-confirm">
            <span className="success-dot" />

            <div>
              <strong>Meeting confirmed</strong>
              <small>Tomorrow · 10:30 AM</small>
            </div>
          </div>
        </div>
      </section>

      <section className="category-strip">
        <div>
          <span className="section-kicker">ONE PLACE, MANY NEEDS</span>
          <h2>Resources for real-world meetings.</h2>
        </div>

        <div className="category-grid">
          {categories.map(([name, image]) => (
            <div className="category-card" key={name}>
              <img src={image} alt={name} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </section>

      <FeatureCarousel />

      <section className="home-steps">
        <span className="section-kicker">A SIMPLE FLOW</span>
        <h2>From search to scheduled.</h2>

        <div className="step-grid">
          {[
            [
              "01",
              "Search",
              "Choose a resource type and narrow down by provider, name, meeting mode, date, time or distance.",
            ],
            [
              "02",
              "Compare",
              "Open a public profile and understand the resource before deciding to schedule.",
            ],
            [
              "03",
              "Schedule",
              "Pick an available calendar slot and confirm the meeting after login.",
            ],
          ].map(([number, title, text]) => (
            <div className="step-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}