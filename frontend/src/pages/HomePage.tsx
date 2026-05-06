import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import CenteredMain from "../components/CenteredMain";
import { chipUrlForBank } from "../utils/chips";
import { checkDailyBonusStatus, claimDailyBonus } from "../api/dailyBonus";
import "./HomePage.css";

type GameCard = {
  title: string;
  route: string;
  image: string;
  emoji: string;
};

const games: GameCard[] = [
  {
    title: "Blackjack",
    route: "/blackjack",
    image: "/assets/home/blackjack.jpg",
    emoji: "🂡",
  },
  {
    title: "Slots",
    route: "/slots",
    image: "/assets/home/slots.jpg",
    emoji: "🎰",
  },
  {
    title: "Craps",
    route: "/craps",
    image: "/assets/home/craps.jpg",
    emoji: "🎲",
  },
  {
    title: "Roulette",
    route: "/roulette",
    image: "/assets/home/roulette.jpg",
    emoji: "🎯",
  },
];

// Daily Bonus Component - Compact version
function DailyBonusButton() {
  const [available, setAvailable] = useState(false);
  const [hoursRemaining, setHoursRemaining] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const status = await checkDailyBonusStatus();
      setAvailable(status.available);
      setHoursRemaining(status.hoursRemaining || 0);
    } catch (error) {
      console.error("Failed to check daily bonus:", error);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    setMessage("");

    try {
      const result = await claimDailyBonus();
      
      if (result.ok && result.bonusAmount) {
        const currentBank = Number(localStorage.getItem("bjBank") || 500);
        localStorage.setItem("bjBank", String(currentBank + result.bonusAmount));
        
        setMessage(`🎁 +${result.bonusAmount} credits!`);
        setAvailable(false);
        
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(result.error || "Already claimed");
        setHoursRemaining(result.hoursRemaining || 0);
      }
    } catch (error) {
      setMessage("Failed to claim bonus");
    } finally {
      setClaiming(false);
    }
  };

  if (!localStorage.getItem("token")) {
    return null;
  }

  return (
    <div 
      className="panel" 
      style={{ 
        marginBottom: "16px", 
        padding: "12px 16px",
        background: "rgba(255, 215, 0, 0.05)",
        border: "1px solid rgba(255, 215, 0, 0.2)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}></span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "2px" }}>
              Daily Bonus
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7 }}>
              {available
                ? "200 free credits available!"
                : `Next in ${hoursRemaining}h`}
            </div>
          </div>
        </div>
        
        <button
          className={available ? "btn btn-primary" : "btn btn-secondary"}
          onClick={handleClaim}
          disabled={!available || claiming}
          style={{ 
            whiteSpace: "nowrap",
            padding: "8px 16px",
            fontSize: "14px"
          }}
        >
          {claiming ? "..." : available ? "Claim Now" : "Claimed"}
        </button>
      </div>

      {message && (
        <div 
          style={{ 
            marginTop: "8px", 
            padding: "6px 10px",
            background: message.includes("credits") ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 255, 0, 0.1)",
            borderRadius: "4px",
            fontSize: "12px",
            textAlign: "center"
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, loading } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");

  const username = useMemo(
    () => user?.username ?? getOrCreateGuestUsername(),
    [user]
  );

  const bankValue = Number(localStorage.getItem("bjBank") ?? 500);

  const onLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const carouselGames = [...games, ...games];

  return (
    <>
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <span
            id="bankBadge"
            aria-label={`Bank: ${bankValue} chips`}
            style={{
              ["--bank-chip-url" as string]: `url("${chipUrlForBank(bankValue)}")`,
            }}
          >
            {bankValue}
          </span>
        }
        right={
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Link to="/profile" className="btn btn-secondary">
              Profile
            </Link>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onLogout}
              disabled={loading && !!localStorage.getItem("token")}
              title={user ? "Logout" : "Guest mode"}
            >
              Logout
            </button>
          </div>
        }
      />

      <CenteredMain maxWidth={1240}>
        {/* Compact Daily Bonus */}
        <DailyBonusButton />

        <section className="home-lobby">
          <header className="home-lobby-header">
            <h2 className="panel-header">Welcome to the Casino Lobby</h2>
            <p className="panel-subtle">
              Choose a game mode or view your stats below.
            </p>
          </header>

          <div
            className="game-wheel-mask"
            aria-label="Available games"
          >
            <div className="game-wheel-track">
              {carouselGames.map((game, index) => (
                <Link
                  key={`${game.title}-${index}`}
                  to={game.route}
                  className="game-wheel-card"
                  aria-label={`Play ${game.title}`}
                >
                  <div className="game-wheel-image-wrap">
                    <img
                      src={game.image}
                      alt={`${game.title} preview`}
                      className="game-wheel-image"
                    />
                  </div>

                  <div className="game-wheel-content">
                    <span className="game-wheel-emoji" aria-hidden="true">
                      {game.emoji}
                    </span>
                    <span className="game-wheel-title">
                      Play {game.title}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="home-actions">
            <Link to="/leaderboard" className="btn btn-ghost">
              View Leaderboards
            </Link>
            <Link to="/profile" className="btn btn-ghost">
              View Profile
            </Link>
          </div>
        </section>
      </CenteredMain>
    </>
  );
}