import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import CenteredMain from "../components/CenteredMain";
import { chipUrlForBank } from "../utils/chips";
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