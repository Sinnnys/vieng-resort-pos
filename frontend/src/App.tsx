import { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

type Room = {
  id: number;
  roomNumber: string;
  status: string;
  imageUrl?: string | null;
  notes?: string | null;
  price?: number | null;
  contactNumber?: string | null;
  address?: string | null;
};

const galleryImages = [
  '/media/pic4.png',
  '/media/pic3.png',
  '/media/pic6.png',
  '/media/pic5.png',
];

const spaces = [
  { title: 'Apartments', desc: 'Comfortable suites with balcony views and lounge access.', image: '/media/pic5.png' },
  { title: 'Swimming Pool', desc: 'Crystal-clear pool surrounded by tropical gardens.', image: '/media/pic4.png' },
  { title: 'Cafe & Bar', desc: 'Artisan coffee, smoothies, and evening cocktails.', image: '/media/pic4.png' },
  { title: 'Fitness Club', desc: 'Light-filled gym with modern equipment.', image: '/media/pic1.png' },
  { title: 'Garden', desc: 'Lush green courtyards for quiet strolls.', image: '/media/pic7.png' },
  { title: 'Kids Area', desc: 'Family-friendly pool zone and play space.', image: '/media/pic3.png' },
];

const amenities = [
  { title: 'Resort Pool', desc: 'Family-friendly pools and shaded cabanas.', icon: '🏊' },
  { title: 'Fitness Club', desc: 'Modern equipment with natural light.', icon: '💪' },
  { title: 'Cafe & Bar', desc: 'Coffee, smoothies, and evening cocktails.', icon: '☕' },
  { title: 'Events', desc: 'Poolside gatherings and celebrations.', icon: '🎉' },
  { title: 'Lounge', desc: 'Cozy communal lounge for relaxation.', icon: '🛋️' },
  { title: 'Garden', desc: 'Green courtyards and walking paths.', icon: '🌿' },
];

const NAV_LINKS = [
  { label: 'Home', href: '#hero' },
  { label: 'Spaces', href: '#spaces' },
  { label: 'Amenities', href: '#amenities' },
  { label: 'Rooms', href: '#rooms' },
  { label: 'Contact', href: '#contact' },
];

const LEAF_COUNT = 18;

function FallingLeaves() {
  const leaves = Array.from({ length: LEAF_COUNT }, (_, i) => {
    const size = 18 + Math.random() * 22;
    const left = Math.random() * 100;
    const delay = Math.random() * 14;
    const duration = 12 + Math.random() * 10;
    const drift = -40 + Math.random() * 80;
    const rotation = Math.random() * 360;
    const opacity = 0.25 + Math.random() * 0.35;
    return (
      <div
        key={i}
        className="falling-leaf"
        style={{
          '--size': `${size}px`,
          '--left': `${left}%`,
          '--delay': `${delay}s`,
          '--duration': `${duration}s`,
          '--drift': `${drift}px`,
          '--rotation': `${rotation}deg`,
          '--opacity': opacity,
        } as React.CSSProperties}
      />
    );
  });
  return <div className="leaves-container">{leaves}</div>;
}

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return { ref, className: visible ? 'reveal visible' : 'reveal' };
}

function RevealSection({ id, className = '', children }: { id?: string; className?: string; children: React.ReactNode }) {
  const { ref, className: revealClass } = useReveal();
  return (
    <section id={id} ref={ref} className={`${revealClass} ${className}`.trim()}>
      {children}
    </section>
  );
}

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const availableRooms = rooms.filter((r) => r.status === 'available');

  useEffect(() => {
    const loadRooms = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/public/rooms`);
        const data: Room[] = await res.json();
        setRooms(data);
        setSelectedRoom(data.find((r) => r.status === 'available') || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % galleryImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const contact = {
    phone: '+8562055621969',
    address: 'Vieng Resort & Apartment Complex, Vientiane',
    email: 'stay@viengresort.com',
  };

  return (
    <div className="page">
      <FallingLeaves />

      <nav className={`nav${scrolled ? ' nav--scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#hero" onClick={(e) => scrollTo(e, '#hero')} className="nav-brand">
            <img src="/media/logo.png" alt="Vieng Resort" className="nav-logo-img" />
            <span className="nav-title">Vieng Resort</span>
          </a>
          <div className="nav-links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => scrollTo(e, l.href)} className="nav-link">
                {l.label}
              </a>
            ))}
          </div>
          <a className="nav-cta" href="tel:+8562055621969">Book Now</a>
        </div>
      </nav>

      <section id="hero" className="hero">
        <div className="hero-overlay" />
        <div className="hero-images">
          {galleryImages.map((src, idx) => (
            <img
              key={src}
              src={src}
              alt="Resort"
              className={`hero-bg ${idx === heroIdx ? 'active' : ''}`}
            />
          ))}
        </div>
        <div className="hero-content">
          <p className="eyebrow">Welcome to Vieng Resort</p>
          <h1>Where Luxury<br />Meets Nature</h1>
          <p className="hero-desc">
            Crystal pools, lush gardens, modern fitness, and artisan cuisine — all within a serene, 
            family-friendly resort complex in Vientiane.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="tel:+8562055621969">Reserve Now</a>
            <a className="btn btn-outline" href="#spaces" onClick={(e) => scrollTo(e, '#spaces')}>Explore</a>
          </div>
        </div>
        <div className="hero-dots">
          {galleryImages.map((_, idx) => (
            <button
              key={idx}
              className={`dot ${idx === heroIdx ? 'active' : ''}`}
              onClick={() => setHeroIdx(idx)}
            />
          ))}
        </div>
      </section>

      <RevealSection className="section-intro">
        <div className="intro-ornament" />
        <h2 className="section-heading">A Resort-Style Living Experience</h2>
        <p className="section-sub">
          Discover comfort, elegance, and tranquility — whether you stay a night or call it home.
        </p>
      </RevealSection>

      <RevealSection id="spaces" className="section-spaces">
        <h2 className="section-heading">Our Spaces</h2>
        <p className="section-sub">
          Apartments &bull; Pool &bull; Cafe &bull; Gym &bull; Garden
        </p>
        <div className="spaces-grid">
          {spaces.map((s, idx) => (
            <div key={s.title} className="space-card" style={{ '--idx': idx } as React.CSSProperties}>
              <div className="space-img-wrap">
                <img src={s.image} alt={s.title} />
                <div className="space-img-overlay" />
              </div>
              <div className="space-info">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection id="amenities" className="section-amenities">
        <h2 className="section-heading">Amenities & Services</h2>
        <p className="section-sub">Everything you need to relax, play, and recharge</p>
        <div className="amenities-grid">
          {amenities.map((a) => (
            <div key={a.title} className="amenity-card">
              <span className="amenity-icon">{a.icon}</span>
              <h4>{a.title}</h4>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection id="rooms" className="section-rooms">
        <h2 className="section-heading">Available Rooms</h2>
        <p className="section-sub">
          {availableRooms.length} available &middot; {rooms.length} total
        </p>
        {loading ? (
          <p className="muted-text">Loading rooms&hellip;</p>
        ) : availableRooms.length === 0 ? (
          <p className="muted-text">No rooms available at the moment. Contact us for inquiries.</p>
        ) : (
          <>
            <div className="room-grid">
              {availableRooms.map((room) => (
                <div
                  key={room.id}
                  className={`room-card${selectedRoom?.id === room.id ? ' selected' : ''}`}
                  onClick={() => setSelectedRoom(room)}
                >
                  {room.imageUrl ? (
                    <img src={room.imageUrl} alt={room.roomNumber} />
                  ) : (
                    <div className="room-placeholder">Photo Coming Soon</div>
                  )}
                  <div className="room-body">
                    <h4>{room.roomNumber}</h4>
                    <span className="room-price">
                      {room.price != null ? `${room.price.toLocaleString()} LAK` : 'Price on request'}
                    </span>
                    <span className="room-note">{room.notes || 'Ready to book'}</span>
                  </div>
                </div>
              ))}
            </div>
            {selectedRoom && (
              <div className="room-detail-card">
                <h3>Room Details</h3>
                <div className="room-detail-grid">
                  <div><span className="detail-label">Room</span><span>{selectedRoom.roomNumber}</span></div>
                  <div><span className="detail-label">Status</span><span className="status-badge">{selectedRoom.status}</span></div>
                  <div><span className="detail-label">Price</span><span>{selectedRoom.price != null ? `${selectedRoom.price.toLocaleString()} LAK` : 'Contact us'}</span></div>
                  <div><span className="detail-label">Notes</span><span>{selectedRoom.notes || '—'}</span></div>
                  <div><span className="detail-label">Contact</span><span>{selectedRoom.contactNumber || contact.phone}</span></div>
                  <div><span className="detail-label">Address</span><span>{selectedRoom.address || contact.address}</span></div>
                </div>
              </div>
            )}
          </>
        )}
      </RevealSection>

      <RevealSection id="contact" className="section-contact">
        <div className="contact-grid">
          <div className="contact-info">
            <h2 className="section-heading">Get in Touch</h2>
            <div className="contact-line">
              <span className="contact-icon">📞</span>
              <div><strong>Phone</strong><p>{contact.phone}</p></div>
            </div>
            <div className="contact-line">
              <span className="contact-icon">📍</span>
              <div><strong>Address</strong><p>{contact.address}</p></div>
            </div>
            <div className="contact-line">
              <span className="contact-icon">✉️</span>
              <div><strong>Email</strong><p>{contact.email}</p></div>
            </div>
          </div>
          <div className="contact-map">
            <iframe
              title="Google Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3796.674651653511!2d102.65920457549208!3d17.90066038781556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31246566ac0648ef%3A0x5ff591e4b4cdc076!2sSwimming%20pool!5e0!3m2!1sen!2sla!4v1772494244030!5m2!1sen!2sla"
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      </RevealSection>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src="/media/logo.png" alt="Vieng Resort" className="footer-logo-img" />
            <span>Vieng Resort & Apartment Complex</span>
          </div>
          <div className="footer-links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => scrollTo(e, l.href)}>{l.label}</a>
            ))}
          </div>
          <p className="footer-copy">&copy; 2026 Vieng Resort & Apartment Complex. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
