import { PortfolioHero } from "@/features/landing/components/portfolio/PortfolioHero";
import BottomCTA from "@/components/BottomCTA";

function PortfolioPage() {
  return (
    <main>
      <PortfolioHero />
      <div className="h-screen bg-red-100"></div>
      <BottomCTA />
    </main>
  );
}
export default PortfolioPage;
