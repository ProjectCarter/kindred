import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Kindred collects, uses, and protects your information. Your city, your privacy.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 23, 2026">
      <p className="text-base leading-relaxed">
        Kindred is built on trust. This page is a plain-language placeholder that
        explains how we intend to handle your information. Replace it with your
        finalized policy before launch.
      </p>

      <LegalSection heading="Information we collect">
        <p>
          To build your local edition, Kindred may use your approximate location
          and basic preferences. We ask only for what we need to deliver a
          relevant daily edition — nothing more.
        </p>
      </LegalSection>

      <LegalSection heading="How we use information">
        <p>
          Your information helps us personalize your edition, surface nearby
          events and places, and improve the product. We do not sell your
          personal information.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>
          You can control location permissions and notification preferences at
          any time from your device settings. You may request access to or
          deletion of your data by contacting us.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about privacy? Email{" "}
          <a
            href="mailto:hello@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            hello@discoverkindred.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
