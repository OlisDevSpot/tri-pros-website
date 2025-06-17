import ContactHero from "@/features/landing/components/contact/ContactHero";
import ContactForm from "@/features/landing/components/contact/ContactForm";
import ContactInfo from "@/features/landing/components/contact/ContactInfo";

export const metadata = {
  title: "Contact Elite Construction | Schedule Your Consultation",
  description:
    "Contact Elite Construction for your luxury construction project. Schedule a consultation, request a quote, or speak with our expert team today.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <ContactHero />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <ContactForm />
        <ContactInfo />
      </div>
    </main>
  );
}
