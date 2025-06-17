import HomeHero from "@/features/landing/components/home/HomeHero";
import ValuePropositions from "@/features/landing/components/home/ValuePropositions";
import ServicesPreview from "@/features/landing/components/home/ServicesPreview";
import TestimonialsSection from "@/features/landing/components/home/TestimonialsSection";
import PastProjects from "@/features/landing/components/home/PastProjects";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HomeHero />
      <ValuePropositions />
      <ServicesPreview />
      <PastProjects />
      <TestimonialsSection />
    </main>
  );
}
