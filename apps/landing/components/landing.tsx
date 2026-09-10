import { Footer, Header } from "./chrome";
import { Faq } from "./faq";
import { Features } from "./features";
import { Hero } from "./hero";
import { Plans } from "./plans";
import { Reveal } from "./reveal";
import { Customer, Problem, Steps } from "./sections";
import { Signup } from "./signup";

export function Landing() {
  return (
    <div className="page">
      <Header />
      <Hero />
      <Problem />
      <Steps />
      <Features />
      <Customer />
      <Plans />
      <Faq />
      <Signup />
      <Footer />
      <Reveal />
    </div>
  );
}
