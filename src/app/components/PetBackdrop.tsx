const PETS = [
  { src: '/pets/cat.svg', alt: '', className: 'pet-backdrop__pet pet-backdrop__pet--cat' },
  { src: '/pets/dog.svg', alt: '', className: 'pet-backdrop__pet pet-backdrop__pet--dog' },
  { src: '/pets/bone.svg', alt: '', className: 'pet-backdrop__pet pet-backdrop__pet--bone' },
  { src: '/pets/paw.svg', alt: '', className: 'pet-backdrop__pet pet-backdrop__pet--paw-1' },
  { src: '/pets/paw.svg', alt: '', className: 'pet-backdrop__pet pet-backdrop__pet--paw-2' },
  { src: '/pets/paw.svg', alt: '', className: 'pet-backdrop__pet pet-backdrop__pet--paw-3' },
];

export default function PetBackdrop() {
  return (
    <div className="pet-backdrop" aria-hidden="true" data-testid="pet-backdrop">
      {PETS.map((pet, idx) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={idx} src={pet.src} alt={pet.alt} className={pet.className} />
      ))}
    </div>
  );
}
