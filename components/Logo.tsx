import Image from 'next/image'

interface LogoProps {
    width?: number
    height?: number
    className?: string
    priority?: boolean
}

export default function Logo({
    width = 128,
    height = 128,
    className = '',
    priority = true
}: LogoProps) {
    return (
        <Image
            src="/logo.png"
            alt="Stable Wealth Logo"
            width={width}
            height={height}
            className={`object-contain ${className}`}
            priority={priority}
        />
    )
}
