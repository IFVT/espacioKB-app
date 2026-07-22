interface StepperProps {
  current: number; // 1-based
  total: number;
}

export default function Stepper({ current, total }: StepperProps) {
  return (
    <div className="mb-5 flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded ${i < current ? "bg-accent" : "bg-line"}`}
        />
      ))}
    </div>
  );
}
